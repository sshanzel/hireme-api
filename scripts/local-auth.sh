#!/bin/bash

# Re-authenticate with GCS signing capability for local development
PROJECT_ID=$(gcloud config get-value project)
gcloud auth application-default login --impersonate-service-account=core-api@${PROJECT_ID}.iam.gserviceaccount.com --no-launch-browser
