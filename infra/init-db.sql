-- One database per app. Run once, on first container start.
-- Separate databases (not schemas) so an app cannot query another app's tables
-- by accident, and so each app can migrate/drop independently.
CREATE DATABASE portico_hub;
CREATE DATABASE portico_platform;
CREATE DATABASE portico_helpdesk;
CREATE DATABASE portico_codereview;
