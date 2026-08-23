# .NET Version Considerations — reference note

**Reference material, not a design document.** No review gate, no sign-off needed, nothing here is a
committed decision. Written 2026-08-23 by Bowser, prompted by the NuGet audit warnings that surfaced
while implementing Phase 0. **Nothing was changed to produce it** — no `.csproj` edit, no package
version moved, no application code touched. Every claim below was verified against the live tree, the
installed runtime, the NuGet v3 API and the `dotnet/core` release index rather than recalled.

---

## The one thing to take away

**The audit warning and the actual vulnerability are two different problems with two different fixes,
and the obvious fix solves the one that doesn't matter.**

- Bumping `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` from `10.0.0` to `10.0.11`
  **silences the audit warning and changes nothing that executes at runtime.** Verified, not assumed —
  see the probe below.
- Updating the **.NET runtime** fixes the real exposure and **does not silence the audit warning**,
  because the warning is about the package graph, not about what runs.

And the real exposure is not hypothetical. **This machine's runtime is inside the affected range of a
CVSS 9.1 vulnerability whose stated impact is forging authentication cookies** — which is precisely the
mechanism this entire authentication plan rests on. Details in §3.

---

## 1. Is there a newer .NET than `net10.0`?

**No, and `net10.0` is the correct target. Don't move it.**

From the official `dotnet/core` release index, fetched live:

| Channel | Latest release | Latest SDK | Support phase | EOL |
|---|---|---|---|---|
| **11.0** | `11.0.0-preview.7` | `11.0.100-preview.7` | **preview** | — |
| **10.0** | **`10.0.11`** | **`10.0.400`** | **active (LTS)** | **2028-11-14** |
| 9.0 | `9.0.19` | `9.0.317` | maintenance | 2026-11-10 |
| 8.0 | `8.0.30` | `8.0.424` | maintenance | 2026-11-10 |

.NET 11 exists only as **preview 7** (released 2026-08-11); GA lands around November 2026. Retargeting
to `net11.0` would mean running a preview runtime in production for an app whose entire purpose in this
initiative is to be publicly reachable behind a login. There is also no pressure to: .NET 10 is the
current LTS with **active** support until **November 2028**. Revisit after .NET 11 GA, and even then
only because it's tidy, not because anything forces it.

**But `net10.0` is a band, not a version, and that's where the confusion lives.** The `TargetFramework`
is right; what's stale is everything underneath it:

| | This repo / machine | Current | Delta |
|---|---|---|---|
| `TargetFramework` (both projects) | `net10.0` | `net10.0` | ✅ none |
| SDK | `10.0.202` | `10.0.400` | behind |
| ASP.NET Core runtime | **`10.0.6`** | **`10.0.11`** | **5 patches behind** |
| EF Core / Npgsql package pins | `10.0.0` | `10.0.11` / `10.0.3` | 11 patches behind |

(`dotnet --list-sdks` → `10.0.202`; `dotnet --list-runtimes` → `Microsoft.AspNetCore.App 10.0.6`. SDK
`10.0.202` is exactly the SDK shipped with runtime `10.0.6`, so these are consistent, just old.)

---

## 2. What is actually pinned

No `global.json`, no `Directory.Build.props`, no `Directory.Packages.props`, no lock file, no
`nuget.config`. Every version is inline in two `.csproj` files.

**`src/api/MonsterOfTheWeek.Api/MonsterOfTheWeek.Api.csproj`**

| Package | Pinned | Latest 10.0.x | Note |
|---|---|---|---|
| `Microsoft.EntityFrameworkCore.Design` | `10.0.0` | `10.0.11` | `PrivateAssets=all` — build/design-time only, never ships |
| `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` | `10.0.0` | `10.0.11` | added in Phase 0; the one that trips the audit |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | `10.0.0` | **`10.0.3`** | versions independently of EF Core |
| `Swashbuckle.AspNetCore` | `9.0.6` | `10.2.3` (own scheme) | unrelated to the .NET version; out of scope here |

**`src/api/MonsterOfTheWeek.Api.Tests/MonsterOfTheWeek.Api.Tests.csproj`**

| Package | Pinned | Latest 10.0.x |
|---|---|---|
| `Microsoft.EntityFrameworkCore.Sqlite` | `10.0.0` | `10.0.11` |

(`xunit` 2.9.3, `Microsoft.NET.Test.Sdk` 17.14.1, `coverlet.collector` 6.0.4 and
`SQLitePCLRaw.lib.e_sqlite3` 2.1.12 are on their own release cadences and are not part of this
question. Worth noting only that EF Core Sqlite `10.0.11` wants `SQLitePCLRaw` **2.1.12** — exactly
what the test project already pins, so that one needs no thought.)

---

## 3. The finding: the runtime, not the package

### Why the package bump is cosmetic

`Microsoft.AspNetCore.DataProtection` is a **shared-framework assembly**. In a Web SDK project with a
`Microsoft.AspNetCore.App` framework reference, the framework's copy wins over any package copy and the
package assets are dropped during conflict resolution.

**Probed rather than asserted.** A throwaway Web SDK project in the scratchpad (outside this repo)
referencing `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` **10.0.11** — i.e. *higher* than
the installed 10.0.6 framework — produced:

- Build output contains **only** `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore.dll`.
  `Microsoft.AspNetCore.DataProtection.dll` and `System.Security.Cryptography.Xml.dll` are **absent**.
- `deps.json` lists only the EFCore shim; `Microsoft.AspNetCore.DataProtection` appears nowhere in the
  dependency graph at all.
- `runtimeconfig.json` requests `Microsoft.AspNetCore.App` version `10.0.0`, which with default
  roll-forward (`latestPatch`) binds to **the highest installed patch** — `10.0.6` on this machine.

So the code that executes is the shared framework's, at whatever patch is installed, **regardless of
the package version in the `.csproj`**. This exactly matches what was observed in the real repo during
Phase 0 (only the shim DLL lands in `bin/`).

The corollary is the useful half: **installing a newer runtime upgrades the app with no `.csproj`
change whatsoever**, because roll-forward picks it up automatically.

### The vulnerability that is actually live

| Advisory | Package | Affected | Patched in | Runtime here (10.0.6) |
|---|---|---|---|---|
| **GHSA-9mv3-2cwr-p262** / **CVE-2026-40372** — CVSS **9.1** | `Microsoft.AspNetCore.DataProtection` | `>= 10.0.0, <= 10.0.6` | **`10.0.7`** | ❌ **affected** |
| GHSA-37gx-xxp4-5rgx / CVE-2026-33116 | `System.Security.Cryptography.Xml` | `>= 10.0.0, <= 10.0.5` | `10.0.6` | ✅ patched |
| GHSA-w3x6-4m5h-cxqf / CVE-2026-26171 | `System.Security.Cryptography.Xml` | `>= 10.0.0, <= 10.0.5` | `10.0.6` | ✅ patched |

**This corrects my Phase 0 report.** That report said the flagged assemblies "resolve from the shared
framework at runtime" and were therefore "restore-audit noise, not a deployed vulnerability." The first
half is right and now doubly verified. The conclusion was **too broad**: it is true for the eight
`System.Security.Cryptography.Xml` advisories, which the installed 10.0.6 runtime already fixes — but
**false for the critical one**, which needs 10.0.7 and which 10.0.6 does not have.

Read the advisory's own summary, because it is unusually on-the-nose for this project:

> A bug in `Microsoft.AspNetCore.DataProtection` 10.0.0-10.0.6 NuGet packages can give an attacker the
> opportunity to execute an Elevation of Privilege attack by **forging authentication cookies**, and
> also allows some protected payloads to be decrypted.

Forged authentication cookies is the whole threat model of Phases 1–3. (CWE-347, improper verification
of a cryptographic signature — the advisory compares it to the MS10-070 padding-oracle class.)

**Actual exposure today: none.** Phase 0 added key *persistence* but no protector consumer, nothing has
ever been protected or unprotected, no cookie has ever been issued, and the app has never been publicly
reachable. The exposure would begin at Phase 1, on a runtime that is still 10.0.6.

**One free action while it is still free.** The advisory notes that payloads forged during the
vulnerable window stay valid after upgrading *unless the key ring is rotated*. The single row now in
`data_protection_keys` was generated by an affected runtime. Nothing was ever signed with it, so
rotating is a `DELETE FROM data_protection_keys;` and a restart — trivial now, materially less trivial
once there is a live session to invalidate. Do it as part of the runtime update rather than spending
time reasoning about whether it's strictly necessary.

---

## 4. Breaking changes and blast radius of the package bump

### Version delta

`10.0.0` → `10.0.11` is **11 servicing patches over ~9 months** (2025-11-11 → 2026-08-11), of which
**8 are security releases** covering roughly 38 CVEs. These are servicing patches within a single major
version, which by .NET's servicing policy are non-breaking by design — bug and security fixes only, no
API changes.

### Dependency-range check (the one thing that could genuinely bite)

The concern raised in the Phase 0 report was that `DataProtection.EntityFrameworkCore` 10.0.11 requires
`Microsoft.EntityFrameworkCore >= 10.0.11`, dragging EF Core off its 10.0.0 pin and underneath the
Npgsql provider. **Checked against the actual nuspecs, and it is a non-issue:**

| Package | Declares |
|---|---|
| `Npgsql.EntityFrameworkCore.PostgreSQL` **10.0.0** | `Microsoft.EntityFrameworkCore` **`[10.0.0, 11.0.0)`** |
| `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 | `Microsoft.EntityFrameworkCore` `[10.0.4, 11.0.0)` |
| `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` 10.0.11 | `Microsoft.EntityFrameworkCore` `10.0.11` |

EF Core `10.0.11` sits **inside the range Npgsql 10.0.0 already declares as supported**. The provider
does not need to move at all for the bump to be legitimate. Npgsql 10.0.3 is available and is the
tidier pairing, but it is optional, not required.

### Blast radius in *this* repo specifically

Small, and bounded by things that are already verified every run:

- **Migrations.** No regeneration needed. The existing eight migrations are committed C# that emit
  fixed DDL; a patch-level EF bump does not rewrite them. The `ProductVersion` string stamped into
  `__EFMigrationsHistory` for *new* migrations would read `10.0.11`, which is cosmetic. The check is
  `dotnet ef migrations script`, which is already part of the Phase 0 verification routine.
- **EF behaviour.** The query surface here is plain LINQ — `Where`/`OrderBy`/`Select` projections and
  nested collection projections. No raw SQL, no `EF.Functions.*` provider-specific calls (deliberately
  avoided during Search Phase 1 so the SQLite tests keep working), no compiled queries, no interceptors.
  There is very little for a servicing patch to change.
- **The test project.** `Microsoft.EntityFrameworkCore.Sqlite` would move in lockstep; its
  `SQLitePCLRaw` requirement at 10.0.11 is 2.1.12, already pinned. The 160-test suite plus the
  SQLite `EnsureCreatedAsync()` paths are the real regression check and they run in about a second.
- **Nothing else is pinned in lockstep.** Swashbuckle, xunit, the test SDK and coverlet are all on
  independent cadences and are unaffected either way.

Realistically: a four-line version edit, `dotnet build`, `dotnet test`, `dotnet ef migrations script`,
and a smoke test of the endpoints. Under half an hour, with the failure mode being loud rather than
silent.

---

## 5. Recommendation

**Split it. The two halves have genuinely different urgency, and treating them as one item gets the
important one wrong.**

**a) Update the .NET SDK/runtime — do this before Phase 1, not later.** This is the half that matters
and it is not really a "version bump" decision at all; it is patching a CVSS 9.1 cookie-forging
vulnerability in the exact component Phase 1 is about to start issuing session cookies with. It needs no
`.csproj` change, no package change, and no code change — install a current SDK (10.0.400, giving
runtime 10.0.11) and roll-forward does the rest. Do the free key-ring rotation at the same time.
**Carry the same requirement into the infrastructure pass:** the Phase 3 Dockerfile must pin a base
image of `10.0.7` or newer — ideally the current patch — or production re-inherits exactly this problem
regardless of what the dev machine has. A base image tag of `10.0` floats to the latest patch, which is
the behaviour you want here; a tag pinned to an old specific patch is the trap.

**b) Bump the four `10.0.0` package pins to `10.0.11` — bundle into the infrastructure pass, don't do
it now.** It is genuinely low-risk and it silences the audit, but it is cosmetic with respect to
security, and Phase 0 just landed. Doing it mid-initiative means that if anything odd shows up during
Phases 1–3 there are two candidate causes instead of one. The audit warnings are visible only on the
test project's restore, nobody is blocked by them, and there is no CI to go red. Move all four together
(`EntityFrameworkCore.Design`, `DataProtection.EntityFrameworkCore`, `EntityFrameworkCore.Sqlite`, and
optionally `Npgsql.EntityFrameworkCore.PostgreSQL` → 10.0.3) so they never drift apart again.

**c) Leave `net10.0` alone.** Don't target .NET 11 until it is GA and there is a reason. .NET 10 is LTS
until November 2028.

**What would force a re-think:** CI arriving with `NuGetAuditMode` failing the build (makes (b) urgent
rather than tidy), or Boo's optional `security-review` ceremony running before (a) is done — in which
case CVE-2026-40372 should be handed over as a known open item rather than discovered.

---

## Appendix — how to re-check this cheaply

The version landscape moves monthly, so the specific numbers above will age. To re-derive rather than
trust them:

```
dotnet --list-sdks ; dotnet --list-runtimes          # what is actually installed
```

Current channel state (`latest-release`, `latest-sdk`, `support-phase`, `eol-date`):
`https://raw.githubusercontent.com/dotnet/core/main/release-notes/releases-index.json`

Per-release CVE lists for a channel:
`https://raw.githubusercontent.com/dotnet/core/main/release-notes/10.0/releases.json`

Affected/patched ranges for a specific advisory:
`https://api.github.com/advisories/GHSA-9mv3-2cwr-p262`

Available versions and declared dependency ranges for any package:
`https://api.nuget.org/v3-flatcontainer/<id-lowercase>/index.json`
`https://api.nuget.org/v3-flatcontainer/<id-lowercase>/<version>/<id-lowercase>.nuspec`

And to see what a project *actually* ships versus what it merely references, check `bin/` and
`deps.json` — not the `.csproj`.
