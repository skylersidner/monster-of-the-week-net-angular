using System.ComponentModel.DataAnnotations;

namespace MonsterOfTheWeek.Api.Contracts;

/*
 * Hunter Playbook contracts — docs/hunter-playbooks/ Phase 3.
 *
 * One endpoint per playbook, carrying the entire nested graph: there are deliberately no
 * sub-resource endpoints for any child collection (phases.md Phase 3). POST and PUT both
 * take UpsertPlaybookRequest whole; GET returns PlaybookDetailResponse, the same shape back.
 *
 * Every child request record leads with a nullable Id. That nullable is the whole
 * mechanism behind the Id-based diff PUT performs: an Id that is present identifies an
 * existing row to update in place, an absent one means insert, and a stored row whose Id
 * never appears is deleted. Preserving those Ids across the GET -> form -> PUT round-trip
 * is what keeps Hunter instances live-linked to the rows they point at (architecture.md
 * Section 3, "Persistence semantics for the upsert-the-graph endpoint"). On POST every Id
 * is simply null, which is the same code path as "all children are new".
 */

// ---------------------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------------------

public sealed record PlaybookListItemResponse(
    Guid Id,
    string Name,
    int StatArrayOptionCount,
    int MoveCount,
    int BespokeSectionCount);

public sealed record PlaybookStatArrayOptionResponse(
    Guid Id,
    int Charm,
    int Cool,
    int Sharp,
    int Tough,
    int Weird,
    int SortOrder);

public sealed record PlaybookMoveResponse(
    Guid Id,
    string Name,
    string? DescriptionText,
    bool Required,
    int SortOrder,
    // Phase 6. Nesting a Move's pick-structure here rather than exposing PlaybookMoveId on
    // a flat list is what makes the "filter PlaybookMoveId IS NULL" reading rule structural:
    // PlaybookDetailResponse.BespokeSections carries playbook-level rulesets only, and a
    // client physically cannot confuse the two. Almost always empty.
    IReadOnlyList<BespokeSectionResponse> BespokeSections);

public sealed record PlaybookGearOptionResponse(
    Guid Id,
    string Name,
    string? MechanicalText,
    int SortOrder);

public sealed record PlaybookGearCategoryResponse(
    Guid Id,
    string Label,
    int? PickCount,
    bool IsOptional,
    int SortOrder,
    IReadOnlyList<PlaybookGearOptionResponse> Options);

public sealed record PlaybookLookOptionResponse(
    Guid Id,
    string Text,
    int SortOrder);

public sealed record PlaybookLookCategoryResponse(
    Guid Id,
    bool AllowsFreeform,
    int SortOrder,
    IReadOnlyList<PlaybookLookOptionResponse> Options);

public sealed record PlaybookImprovementResponse(
    Guid Id,
    string Text,
    bool IsAdvanced,
    int SortOrder);

public sealed record PlaybookDetailResponse(
    Guid Id,
    string Name,
    string? Description,
    int LuckBoxCount,
    string? LuckSpecialText,
    int HarmUnstableThreshold,
    int HarmBoxCount,
    int ExperienceBoxCount,
    int MoveGrantCount,
    string? GettingStartedText,
    string? IntroductionsText,
    string? LevelingUpText,
    string? HistoryPromptsText,
    IReadOnlyList<PlaybookStatArrayOptionResponse> StatArrayOptions,
    IReadOnlyList<PlaybookMoveResponse> Moves,
    IReadOnlyList<PlaybookGearCategoryResponse> GearCategories,
    IReadOnlyList<PlaybookLookCategoryResponse> LookCategories,
    IReadOnlyList<PlaybookImprovementResponse> Improvements,
    IReadOnlyList<BespokeSectionResponse> BespokeSections,
    IReadOnlyList<BespokeJournalResponse> BespokeJournals,
    IReadOnlyList<PlaybookExtraTrackResponse> ExtraTracks);

public sealed record BasicMoveResponse(Guid Id, string Name, string DescriptionText, int SortOrder);

// ---------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------

public sealed record UpsertPlaybookStatArrayOptionRequest(
    Guid? Id,
    int Charm,
    int Cool,
    int Sharp,
    int Tough,
    int Weird,
    int SortOrder);

public sealed record UpsertPlaybookMoveRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Name,
    string? DescriptionText,
    bool Required,
    int SortOrder,
    IReadOnlyList<UpsertBespokeSectionRequest>? BespokeSections);

public sealed record UpsertPlaybookGearOptionRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Name,
    string? MechanicalText,
    int SortOrder);

public sealed record UpsertPlaybookGearCategoryRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Label,
    [param: Range(0, int.MaxValue)] int? PickCount,
    bool IsOptional,
    int SortOrder,
    IReadOnlyList<UpsertPlaybookGearOptionRequest>? Options);

public sealed record UpsertPlaybookLookOptionRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Text,
    int SortOrder);

public sealed record UpsertPlaybookLookCategoryRequest(
    Guid? Id,
    bool AllowsFreeform,
    int SortOrder,
    IReadOnlyList<UpsertPlaybookLookOptionRequest>? Options);

public sealed record UpsertPlaybookImprovementRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Text,
    bool IsAdvanced,
    int SortOrder);

public sealed record UpsertPlaybookRequest(
    [param: Required, MinLength(2)] string Name,
    string? Description,
    [param: Range(0, 50)] int LuckBoxCount,
    string? LuckSpecialText,
    [param: Range(0, 50)] int HarmUnstableThreshold,
    [param: Range(0, 50)] int HarmBoxCount,
    [param: Range(0, 50)] int ExperienceBoxCount,
    // Range starts at 0 deliberately: 0 is the correct stored value between Phase 4 and
    // Phase 6, when the Moves section has not been authored yet.
    [param: Range(0, 20)] int MoveGrantCount,
    string? GettingStartedText,
    string? IntroductionsText,
    string? LevelingUpText,
    string? HistoryPromptsText,
    IReadOnlyList<UpsertPlaybookStatArrayOptionRequest>? StatArrayOptions,
    IReadOnlyList<UpsertPlaybookMoveRequest>? Moves,
    IReadOnlyList<UpsertPlaybookGearCategoryRequest>? GearCategories,
    IReadOnlyList<UpsertPlaybookLookCategoryRequest>? LookCategories,
    IReadOnlyList<UpsertPlaybookImprovementRequest>? Improvements,
    IReadOnlyList<UpsertBespokeSectionRequest>? BespokeSections,
    IReadOnlyList<UpsertBespokeJournalRequest>? BespokeJournals,
    IReadOnlyList<UpsertPlaybookExtraTrackRequest>? ExtraTracks);

// ---------------------------------------------------------------------------------------
// Phase 5 — bespoke rulesets. architecture.md Section 6.
//
// BespokeOption is a self-referencing tree in the database (ParentOptionId), but it is
// exposed here as **nested children**, not a flat list plus parent ids. The nesting is the
// point of the model — "pick 2 of my children" is what makes multi-level structures work —
// and a flat wire format would force every client to rebuild the tree before it could
// render or edit one. The service flattens to ParentOptionId when persisting.
// ---------------------------------------------------------------------------------------

public sealed record BespokeOptionResponse(
    Guid Id,
    string? Title,
    string? DescriptionText,
    int? MinSelect,
    int? MaxSelect,
    int? NumericMin,
    int? NumericMax,
    int SortOrder,
    IReadOnlyList<BespokeOptionResponse> Children);

public sealed record BespokeSectionResponse(
    Guid Id,
    string Title,
    string? Description,
    string? EffectText,
    string? FreeTextLabel,
    int? MinSelect,
    int? MaxSelect,
    int? MinInstances,
    int? MaxInstances,
    int SortOrder,
    IReadOnlyList<BespokeOptionResponse> Options);

public sealed record BespokeJournalFieldResponse(Guid Id, string Label, int SortOrder);

public sealed record BespokeJournalResponse(
    Guid Id,
    string Title,
    string? Description,
    string? EffectText,
    int SortOrder,
    IReadOnlyList<BespokeJournalFieldResponse> Fields);

public sealed record PlaybookExtraTrackResponse(
    Guid Id,
    string Name,
    string Description,
    string? EffectText,
    int BoxCount,
    string? StartLabel,
    string EndLabel,
    int SortOrder);

public sealed record UpsertBespokeOptionRequest(
    Guid? Id,
    string? Title,
    string? DescriptionText,
    int? MinSelect,
    int? MaxSelect,
    int? NumericMin,
    int? NumericMax,
    int SortOrder,
    IReadOnlyList<UpsertBespokeOptionRequest>? Children);

public sealed record UpsertBespokeSectionRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Title,
    string? Description,
    string? EffectText,
    string? FreeTextLabel,
    int? MinSelect,
    int? MaxSelect,
    int? MinInstances,
    int? MaxInstances,
    int SortOrder,
    IReadOnlyList<UpsertBespokeOptionRequest>? Options);

public sealed record UpsertBespokeJournalFieldRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Label,
    int SortOrder);

public sealed record UpsertBespokeJournalRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Title,
    string? Description,
    string? EffectText,
    int SortOrder,
    IReadOnlyList<UpsertBespokeJournalFieldRequest>? Fields);

public sealed record UpsertPlaybookExtraTrackRequest(
    Guid? Id,
    [param: Required, MinLength(1)] string Name,
    [param: Required, MinLength(1)] string Description,
    string? EffectText,
    [param: Range(1, 50)] int BoxCount,
    string? StartLabel,
    [param: Required, MinLength(1)] string EndLabel,
    int SortOrder);
