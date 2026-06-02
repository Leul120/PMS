-- Add deep-link route for in-app notification navigation
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS action_url VARCHAR(512);
