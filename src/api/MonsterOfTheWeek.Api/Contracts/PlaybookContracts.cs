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
    int MoveCount);

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
    int SortOrder);

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
    IReadOnlyList<PlaybookImprovementResponse> Improvements);

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
    int SortOrder);

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
    IReadOnlyList<UpsertPlaybookImprovementRequest>? Improvements);
