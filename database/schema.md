# Database Schema Reference

For the comprehensive specification of tables, columns, indexes, and relationships, refer to:
[docs/database.md](../docs/database.md)

### Migration Script:
To re-verify or apply migrations on an environment, execute:
```bash
python database/apply_migrations.py
```

### Table Inventory (13 Tables):
1. `users`
2. `email_verification_otps`
3. `password_reset_otps`
4. `meetings`
5. `participants`
6. `meeting_messages`
7. `transcripts`
8. `action_items`
9. `meeting_summaries`
10. `decisions`
11. `meeting_files`
12. `embeddings_metadata`
13. `meeting_settings`
