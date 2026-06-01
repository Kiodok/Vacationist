-- Phase: Stuff Feature
-- Migration 1: packing_categories, packing_items, shared_packing_items, lost_found_cases

----------------------------------------------------------------------
-- 1. PACKING_CATEGORIES (seed data, read-only for clients)
----------------------------------------------------------------------

CREATE TABLE public.packing_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) <= 100),
  icon       TEXT CHECK (icon IS NULL OR char_length(icon) <= 50),
  sort_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.packing_categories ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read categories
CREATE POLICY "packing_categories_select"
  ON public.packing_categories FOR SELECT TO authenticated
  USING (TRUE);

-- Seed default categories
INSERT INTO public.packing_categories (name, icon, sort_order, is_default) VALUES
  ('Clothes',     'shirt-outline',        10, TRUE),
  ('Cosmetics',   'color-palette-outline', 20, TRUE),
  ('Documents',   'document-text-outline', 30, TRUE),
  ('Electronics', 'phone-portrait-outline',40, TRUE),
  ('Outdoor',     'leaf-outline',         50, TRUE),
  ('Medicine',    'medical-outline',       60, TRUE),
  ('Shared',      'people-outline',        70, TRUE),
  ('Other',       'ellipsis-horizontal-outline', 80, TRUE);

----------------------------------------------------------------------
-- 2. PACKING_ITEMS (private per-user per-trip)
----------------------------------------------------------------------

CREATE TABLE public.packing_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category              TEXT NOT NULL CHECK (char_length(category) <= 100),
  title                 TEXT NOT NULL CHECK (char_length(title) <= 100),
  is_packed             BOOLEAN NOT NULL DEFAULT FALSE,
  notes                 TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  sort_order            INT NOT NULL DEFAULT 0,
  source_shared_item_id UUID DEFAULT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.packing_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER packing_items_updated_at
  BEFORE UPDATE ON public.packing_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: only the owner, who must be a trip member
CREATE POLICY "packing_items_select"
  ON public.packing_items FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND user_id = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: owner must match caller, caller must be trip member
CREATE POLICY "packing_items_insert"
  ON public.packing_items FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: owner only
CREATE POLICY "packing_items_update"
  ON public.packing_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No direct DELETE RLS — use soft_delete_packing_item RPC

CREATE INDEX idx_packing_items_trip_user
  ON public.packing_items(trip_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_packing_items_category
  ON public.packing_items(trip_id, user_id, category)
  WHERE deleted_at IS NULL;

-- Immutable fields guard
CREATE OR REPLACE FUNCTION public.restrict_packing_item_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id on packing_items';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id on packing_items';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change created_at on packing_items';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_restrict_packing_item_update
  BEFORE UPDATE ON public.packing_items
  FOR EACH ROW EXECUTE FUNCTION public.restrict_packing_item_update_fields();

----------------------------------------------------------------------
-- 3. SHARED_PACKING_ITEMS
----------------------------------------------------------------------

CREATE TABLE public.shared_packing_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) <= 100),
  item_type   TEXT NOT NULL CHECK (item_type IN ('i_got_it', 'who_has', 'everyone')),
  notes       TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by  UUID NOT NULL REFERENCES public.users(id),
  claimed_by  UUID REFERENCES public.users(id) DEFAULT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.shared_packing_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER shared_packing_items_updated_at
  BEFORE UPDATE ON public.shared_packing_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: all trip members
CREATE POLICY "shared_packing_items_select"
  ON public.shared_packing_items FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- INSERT: creator must be caller, caller must be trip member
CREATE POLICY "shared_packing_items_insert"
  ON public.shared_packing_items FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: any trip member (for claiming)
CREATE POLICY "shared_packing_items_update"
  ON public.shared_packing_items FOR UPDATE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()));

-- No direct DELETE — use soft_delete_shared_packing_item RPC

CREATE INDEX idx_shared_packing_items_trip
  ON public.shared_packing_items(trip_id)
  WHERE deleted_at IS NULL;

-- Immutable fields guard
CREATE OR REPLACE FUNCTION public.restrict_shared_packing_item_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id on shared_packing_items';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by on shared_packing_items';
  END IF;
  IF NEW.item_type IS DISTINCT FROM OLD.item_type THEN
    RAISE EXCEPTION 'Cannot change item_type on shared_packing_items';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_restrict_shared_packing_item_update
  BEFORE UPDATE ON public.shared_packing_items
  FOR EACH ROW EXECUTE FUNCTION public.restrict_shared_packing_item_update_fields();

----------------------------------------------------------------------
-- 4. LOST_FOUND_CASES
----------------------------------------------------------------------

CREATE TABLE public.lost_found_cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  case_type   TEXT NOT NULL CHECK (case_type IN ('lost_unknown', 'lost_known', 'found_unknown', 'found_owner_known')),
  title       TEXT NOT NULL CHECK (char_length(title) <= 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  created_by  UUID NOT NULL REFERENCES public.users(id),
  target_user UUID REFERENCES public.users(id) DEFAULT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lost_found_cases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER lost_found_cases_updated_at
  BEFORE UPDATE ON public.lost_found_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: any trip member (client-side visibility filtering: created_by = me OR target_user = me OR target_user IS NULL)
CREATE POLICY "lost_found_cases_select"
  ON public.lost_found_cases FOR SELECT TO authenticated
  USING (
    private.is_trip_member(trip_id, auth.uid())
    AND (
      created_by = auth.uid()
      OR target_user = auth.uid()
      OR target_user IS NULL
    )
  );

-- INSERT: creator must be caller, must be trip member
CREATE POLICY "lost_found_cases_insert"
  ON public.lost_found_cases FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_trip_member(trip_id, auth.uid())
  );

-- UPDATE: trip member (to mark resolved)
CREATE POLICY "lost_found_cases_update"
  ON public.lost_found_cases FOR UPDATE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()));

-- No direct DELETE — use delete_lost_found_case RPC

CREATE INDEX idx_lost_found_cases_trip
  ON public.lost_found_cases(trip_id);

CREATE INDEX idx_lost_found_cases_target_user
  ON public.lost_found_cases(target_user)
  WHERE is_resolved = FALSE;

-- Immutable fields guard
CREATE OR REPLACE FUNCTION public.restrict_lost_found_case_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change trip_id on lost_found_cases';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by on lost_found_cases';
  END IF;
  IF NEW.case_type IS DISTINCT FROM OLD.case_type THEN
    RAISE EXCEPTION 'Cannot change case_type on lost_found_cases';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_restrict_lost_found_case_update
  BEFORE UPDATE ON public.lost_found_cases
  FOR EACH ROW EXECUTE FUNCTION public.restrict_lost_found_case_update_fields();
