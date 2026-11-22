# Security and privacy minimums before pilot

- This starter uses fictitious names and in-memory mock data. There is no real login, isolation guard or database-driven API yet.
- Require user authentication and **membership authorization** for every request. Test tenant crossing and IDOR.
- Enforce server-side role scopes, not frontend role flags.
- Avoid storing raw OAuth tokens, recordings, credentials or student data in the repository.
- Recordings, transcripts, minors' data and AI processing require explicit permissions and retention/deletion rules.
- Apply audit logs and consent records for changed bookings, sensitive data, payments and invitations.
- All auto-generated educational content must be reviewed by the teaching staff before being published to students.
- Protect links to classroom materials and meeting join URLs from public exposure.
- Do a schema integrity/security review and add database migrations before running with real customers.
