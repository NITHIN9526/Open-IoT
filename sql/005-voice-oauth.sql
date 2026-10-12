BEGIN;
CREATE TABLE oauth_clients (
 id text PRIMARY KEY,
 provider text NOT NULL CHECK(provider IN ('google','alexa')),
 name text NOT NULL,
 secret_hash bytea NOT NULL CHECK(octet_length(secret_hash)=32),
 redirect_uris text[] NOT NULL CHECK(cardinality(redirect_uris)>0),
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE oauth_interactions (
 id_hash bytea PRIMARY KEY,
 browser_hash bytea NOT NULL,
 client_id text NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
 redirect_uri text NOT NULL,
 state text NOT NULL,
 challenge text,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE TABLE oauth_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_id text NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
 scope text NOT NULL DEFAULT 'devices:control' CHECK(scope='devices:control'),
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE INDEX oauth_grants_user ON oauth_grants(user_id);
CREATE TABLE oauth_codes (
 token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32),
 grant_id uuid NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
 redirect_uri text NOT NULL,
 challenge text,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes'
);
CREATE TABLE oauth_access_tokens (
 token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32),
 grant_id uuid NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour'
);
CREATE TABLE oauth_refresh_tokens (
 token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32),
 grant_id uuid NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days'
);
CREATE INDEX oauth_access_grant ON oauth_access_tokens(grant_id);
CREATE INDEX oauth_refresh_grant ON oauth_refresh_tokens(grant_id);
CREATE INDEX oauth_access_expiry ON oauth_access_tokens(expires_at);
CREATE INDEX oauth_refresh_expiry ON oauth_refresh_tokens(expires_at);
CREATE TABLE voice_devices (
 device_id uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
 power_pin varchar(3) NOT NULL,
 brightness_pin varchar(3),
 token_version integer NOT NULL,
 FOREIGN KEY(device_id,power_pin) REFERENCES device_pins(device_id,pin) ON DELETE CASCADE,
 FOREIGN KEY(device_id,brightness_pin) REFERENCES device_pins(device_id,pin) ON DELETE CASCADE,
 CHECK(brightness_pin IS NULL OR brightness_pin<>power_pin)
);
-- Keep deduplication tombstones independently of device-command retention.
CREATE TABLE voice_requests (
 grant_id uuid NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
 request_key text NOT NULL,
 fingerprint text NOT NULL,
 command_ids uuid[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(grant_id,request_key)
);
CREATE FUNCTION revoke_voice_on_password_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
  UPDATE oauth_grants SET revoked_at=now() WHERE user_id=NEW.id AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_revoke_voice AFTER UPDATE OF password_hash ON users
 FOR EACH ROW EXECUTE FUNCTION revoke_voice_on_password_change();
COMMIT;
