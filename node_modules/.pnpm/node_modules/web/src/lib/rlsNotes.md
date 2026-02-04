# RLS Notes

This app uses Supabase Row Level Security (RLS) to keep quiz content private while allowing anonymous players to join sessions.

Key ideas:
- Quiz and question rows are only accessible to their owner (`owner_id = auth.uid()`).
- Session rows are readable by anonymous users by code so they can join. Only the host can create/update/end sessions.
- Participants can be inserted anonymously to join a session. Anonymous users can read participants for active sessions to power live leaderboards.
- Answers can be inserted anonymously only while a session is in the `question` state. Unique constraints prevent multiple answers.
- The host (authenticated) calculates scores and updates participants and answers.
- Players never need access to correct answers. The host writes a `public_question` payload on the session so players can render questions without reading the `questions` table.
