-- =============================================================================
-- Migration 00014: sex on user_profiles, session_id on strength_session_runs,
--                  update auth trigger to handle sex metadata
-- =============================================================================

-- 1. Add sex column to user_profiles (for club records and athlete profiles)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('M', 'F'));

-- 2. Add session_id to strength_session_runs (for catalog workout resume)
ALTER TABLE strength_session_runs
  ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES strength_sessions(id) ON DELETE SET NULL;

-- 3. Update auth trigger to extract sex from signup metadata
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
    user_sex TEXT;
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

    user_sex := CASE
        WHEN raw_meta ->> 'sex' IN ('M', 'F')
        THEN raw_meta ->> 'sex'
        ELSE NULL
    END;

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
        'athlete',
        user_birthdate,
        true
    )
    RETURNING id INTO new_user_id;

    -- Create user_profiles row (new users are NOT approved by default)
    INSERT INTO public.user_profiles (user_id, group_id, display_name, email, birthdate, sex, is_approved)
    VALUES (new_user_id, user_group_id, display_name, NEW.email, user_birthdate, user_sex, false);

    -- Add to group if specified
    IF user_group_id IS NOT NULL THEN
        INSERT INTO public.group_members (group_id, user_id)
        VALUES (user_group_id, new_user_id)
        ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;

    -- Inject app_user_id and app_user_role into Supabase JWT claims
    -- This makes them available to RLS via app_user_id() and app_user_role()
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('app_user_id', new_user_id)
        || jsonb_build_object('app_user_role', 'athlete')
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;
