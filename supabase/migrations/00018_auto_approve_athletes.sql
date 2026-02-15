-- =============================================================================
-- Migration: Auto-approve athletes, require approval for coaches
--
-- Athletes can login immediately after signup (is_approved = true)
-- Coaches require admin/coach approval (is_approved = false)
-- Auto-confirm emails to avoid verification issues
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Update the auth trigger to handle role-based auto-approval
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_user_id INTEGER;
    display_name TEXT;
    raw_meta JSONB;
    user_birthdate DATE;
    user_group_id INTEGER;
    user_role TEXT;
    should_approve BOOLEAN;
BEGIN
    raw_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    display_name := COALESCE(
        raw_meta ->> 'display_name',
        raw_meta ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- Parse optional fields from signup metadata
    user_birthdate := CASE
        WHEN raw_meta ->> 'birthdate' IS NOT NULL
        THEN (raw_meta ->> 'birthdate')::date
        ELSE NULL
    END;

    user_group_id := CASE
        WHEN raw_meta ->> 'group_id' IS NOT NULL
        THEN (raw_meta ->> 'group_id')::integer
        ELSE NULL
    END;

    -- Get role from metadata (defaults to 'athlete')
    user_role := COALESCE(raw_meta ->> 'role', 'athlete');

    -- Auto-approve athletes, require approval for coaches
    should_approve := (user_role = 'athlete');

    -- Insert into public.users
    INSERT INTO public.users (
        display_name,
        display_name_lower,
        email,
        role,
        birthdate,
        is_active
    ) VALUES (
        display_name,
        lower(display_name),
        NEW.email,
        user_role,
        user_birthdate,
        true
    )
    RETURNING id INTO new_user_id;

    -- Create user_profiles row with role-based approval
    INSERT INTO public.user_profiles (
        user_id,
        group_id,
        display_name,
        email,
        birthdate,
        is_approved,
        approved_at
    )
    VALUES (
        new_user_id,
        user_group_id,
        display_name,
        NEW.email,
        user_birthdate,
        should_approve,
        CASE WHEN should_approve THEN now() ELSE NULL END
    );

    -- Add to group if specified
    IF user_group_id IS NOT NULL THEN
        INSERT INTO public.group_members (group_id, user_id)
        VALUES (user_group_id, new_user_id)
        ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;

    -- Inject app_user_id and app_user_role into Supabase JWT claims
    -- This makes them available to RLS via app_user_id() and app_user_role()
    UPDATE auth.users
    SET
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
            || jsonb_build_object('app_user_id', new_user_id)
            || jsonb_build_object('app_user_role', user_role),
        -- Auto-confirm email to avoid verification issues
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;
