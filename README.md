# monster-of-the-week-net-angular

Phase 1 foundation for a .NET API + Angular web app with local Postgres groundwork.

## Project structure

- `src/api/MonsterOfTheWeek.Api` - ASP.NET Core API foundation (`net10.0`)
- `src/web/monster-of-the-week-web` - Angular app foundation (Angular 22)
- `docker-compose.yml` - Local Postgres container

## Local development quick start

1. (Optional) Copy `.env.example` to `.env` and adjust credentials.
2. Start Postgres:
   - `docker compose up -d postgres`
3. Start API:
   - `dotnet run --project src/api/MonsterOfTheWeek.Api`
4. Start Angular app:
   - `cd src/web/monster-of-the-week-web`
   - `npm start`
5. Open `http://localhost:4200` and verify the health-status page reports API liveness.
