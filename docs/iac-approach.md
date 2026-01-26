1. Prototype in Console - Click around, experiment with settings
2. Codify in Pulumi - Once you know what you want, write the IaC
3. Import or recreate - Either pulumi import or delete + recreate via Pulumi
4. Never touch console again for that resource

What to always keep in IaC:

- IAM / Service Accounts
- Networking (VPC, firewall rules)
- Databases
- Cloud Run / GKE services
- Pub/Sub topics/subscriptions
- Storage buckets

Acceptable exceptions:

- One-off debugging/investigation
- Secrets (use Secret Manager, reference by name in IaC)
- DNS (sometimes managed elsewhere)
- Billing alerts
