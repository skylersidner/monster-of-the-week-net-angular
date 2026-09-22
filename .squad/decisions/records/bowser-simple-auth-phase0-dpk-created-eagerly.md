### 2026-08-23: Phase 0 implemented — and `data_protection_keys` DOES gain a row on first startup, reversing my own 2026-08-19 correction

**By:** Bowser (Backend Developer / DevOps)
**Requested by:** Skyler Sidner — implement Phase 0 of `docs/simple-authentication-update/phases.md`.

**What:**

1. **Phase 0 shipped as specified**, with no deviation from the plan's six steps. New `Data/Entities/AppUser.cs`
   (plain POCO, no `ITimestamped`, no `Username`), `MotwDbContext` implements `IDataProtectionKeyContext` with
   `DbSet<AppUser> AppUsers` (not `Users`), explicit mappings for `app_users` (unique index on `email`) and
   `data_protection_keys`, migration `20260823203810_AddAppUsersAndDataProtectionKeys`, `AddDataProtection()
   .PersistKeysToDbContext<MotwDbContext>().SetApplicationName("MonsterOfTheWeek")`, and
   `IUserRepository`/`UserRepository.FindByEmailAsync`. One new package, `Microsoft.AspNetCore
   .DataProtection.EntityFrameworkCore` 10.0.0. No auth package sneaked in.

2. **`data_protection_keys` is NOT empty at the end of Phase 0. It has exactly one row, created at first
   startup, with no protector consumer anywhere in the codebase.** Verified live against Postgres:
   `id=1, friendly_name='key-47a42b7a-…', length(xml)=887`. The startup log shows the key being generated and
   `INSERT`ed before `Now listening on:` is printed.

   **This directly reverses the correction I filed on 2026-08-19**, which is recorded in `architecture.md` §1.7,
   `phases.md` Phase 0 (the block quote "Corrected 2026-08-19 (Bowser's review)"), decision #7, and
   `open-questions.md`'s dispositions table. That correction said the key ring is created lazily on first
   `Protect`/`Unprotect`, therefore the table would be created empty and stay empty for all of Phase 0, therefore
   the original "gains a row on first startup" wording would mislead an implementer into thinking Phase 0 failed.
   **The original wording was right and my correction was wrong.**

   The mechanism I missed: `AddDataProtection()` registers `DataProtectionHostedService`, which calls
   `IKeyRingProvider.GetCurrentKeyRing()` on application start specifically so that key-ring configuration errors
   surface at boot rather than on the first request. Key *ring creation* is eager; only key *use* is lazy. The
   "lazily on first Protect/Unprotect" description is true of `IDataProtectionProvider` in isolation, which is
   what I reasoned about, but not of the hosted DI registration this plan actually uses.

3. **Recommended doc fix (not applied — this is a design doc under Yoshi's ownership, and it is a signed-off
   plan):** revert the Phase 0 verification bullet to "`data_protection_keys` gains one row on first startup",
   drop or rewrite the "Corrected 2026-08-19" block quote in `phases.md` Phase 0, and amend §1.7 and decision #7.
   **Keep the Phase 1 assertion regardless** — it is still a strictly better test there, but for a different
   reason than stated: the Phase 1 row is not the *first* row, so the check must be "the ticket decrypts across a
   restart" or "the existing key is used", not "a row appears".

4. **Two things worth knowing that Phase 0 surfaced but did not need to fix.**
   (a) Startup logs `No XML encryptor configured. Key {…} may be persisted to storage in unencrypted form.`
   The key ring XML sits in Postgres unencrypted. Consistent with a plan that already stores the password in
   plaintext in the same database, so not a new class of exposure — but it is a new warning in the startup log
   and someone will ask about it during the deployment pass.
   (b) The new package's NuGet audit flags transitive `Microsoft.AspNetCore.DataProtection` 10.0.0 (Critical) and
   `System.Security.Cryptography.Xml` 10.0.0 (High ×8). **Verified non-deploying:** neither assembly lands in
   either project's build output — only `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore.dll` does, and
   the rest resolve from the ASP.NET Core shared framework at runtime. It is restore-audit noise, not a shipped
   vulnerability.

**Why:**

On (2), the whole risk profile of Phase 0 is "this fails silently," and the doc now tells an implementer to expect
an empty table. An implementer who sees a row will either think they wired something wrong or — worse — go
looking for the protector consumer that "must" exist. Filing it rather than quietly leaving the docs wrong is the
point of the review trail that produced the bad correction in the first place.

On (4b), the plan pins "10.0.x, matching the existing EF/Npgsql pins", i.e. 10.0.0. Clearing the audit warning
means moving to 10.0.11, whose nuspec requires `Microsoft.EntityFrameworkCore >= 10.0.11` and would therefore drag
the whole EF stack up from the repo's 10.0.0 pins as a side effect. **Declined for Phase 0 and left at 10.0.0:**
a repo-wide EF patch bump is its own decision with its own blast radius, and it has no business happening as a
side effect of a phase whose entire premise is "purely additive, nothing else changes." Worth doing deliberately,
separately, if the warnings become noise.

**Files touched:** `MonsterOfTheWeek.Api.csproj`, `Program.cs`, `Data/MotwDbContext.cs`,
`Data/Entities/AppUser.cs` (new), `Repositories/IUserRepository.cs` + `UserRepository.cs` (new),
`Data/Migrations/20260823203810_AddAppUsersAndDataProtectionKeys.{cs,Designer.cs}` (new),
`Data/Migrations/MotwDbContextModelSnapshot.cs` (+52, −0). **No test-project changes** — 160/160 still green.
