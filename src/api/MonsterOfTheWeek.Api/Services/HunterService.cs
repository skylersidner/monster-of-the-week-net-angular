using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Repositories;

namespace MonsterOfTheWeek.Api.Services;

public sealed class HunterService(IHunterRepository hunterRepository) : IHunterService
{
    public async Task<IReadOnlyList<HunterListItemResponse>> GetAllAsync(CancellationToken cancellationToken)
    {
        var hunters = await hunterRepository.GetAllHuntersAsync(cancellationToken);
        return hunters
            .Select(x => new HunterListItemResponse(
                x.Id,
                x.Name,
                x.PlaybookId,
                x.Playbook.Name,
                x.CreatedAt))
            .ToList();
    }
}
