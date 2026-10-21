# LTV ICT Workflow

A starter internal project/task management application built with HTML, CSS, JavaScript and Supabase.

## Included
- Email/password sign-in
- Dashboard counts for projects, open tasks, completed tasks and overdue tasks
- Create projects and tasks
- Assign tasks to ICT team members
- Change task status
- Search and filter tasks
- Responsive layout with navy/red LTV-inspired styling
- Supabase PostgreSQL schema and row-level security policies

## 1. Create the Supabase project
1. Create a project at https://supabase.com/.
2. Open **SQL Editor**, create a query, paste `schema.sql`, and run it.
3. In **Authentication > Providers / Sign-in**, enable Email/password.
4. Disable public sign-ups. Create/invite ICT staff accounts from the Supabase dashboard only.
5. For each account, confirm the `profiles` row exists. The included trigger creates it automatically when the Auth user is created.

## 2. Configure the browser app
1. Open `script.js`.
2. Replace `YOUR_SUPABASE_PROJECT_URL` with the Project URL from **Project Settings > API**.
3. Replace `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with the project's publishable key (or legacy anon key).
4. Never put a `service_role` key in browser code.

## 3. Run locally
Use Visual Studio Code and the Live Server extension, or run a static server from this folder:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

Opening `index.html` directly may work in some browsers, but a local server is recommended.

## 4. First-use checklist
- Sign in with an ICT account created by an administrator.
- Create a project.
- Create a task under that project.
- Assign it to a team member.
- Change its status and confirm dashboard totals update.
- Test with a second authorized account.

## Security notes
- The SQL policies assume all authenticated accounts belong to the ICT unit. Keep public sign-ups disabled and only create accounts for authorized ICT staff.
- The browser publishable/anon key is expected to be public; database access must be controlled by RLS policies.
- Do not add the Supabase service-role key to `script.js`, HTML, or any frontend file.
- Before production use, review the access rules with the ICT/security administrator, add role-based permissions if managers and technicians need different rights, and test RLS using separate accounts.
- The visual styling is an LTV-inspired placeholder. Replace the text logo and colours with official brand assets once approved.
