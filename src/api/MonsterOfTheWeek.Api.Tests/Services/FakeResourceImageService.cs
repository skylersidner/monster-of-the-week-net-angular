using MonsterOfTheWeek.Api.Data.Entities;
using MonsterOfTheWeek.Api.Services;
using MonsterOfTheWeek.Api.Services.ResourceImages;

namespace MonsterOfTheWeek.Api.Tests.Services;

/// <summary>
/// A trivial, non-database <see cref="IResourceImageService"/> for the four domain services'
/// existing fake-repository unit tests — none of them exercise image behaviour, they just need
/// the new constructor dependency satisfied without reaching for a real
/// <c>MotwDbContext</c>. <see cref="DeleteAllForOwnerCalls"/> is the one thing worth recording:
/// it is what the owner-delete cleanup fix (phases.md Phase 3) actually calls, so a test that
/// wants to assert "cleanup happened" without a real database can check it here.
/// </summary>
internal sealed class FakeResourceImageService : IResourceImageService
{
    public List<(DomainOwnerType OwnerType, Guid OwnerId)> DeleteAllForOwnerCalls { get; } = [];

    public Task<ServiceResult<ResourceImageUploadResult>> UploadAsync(
        DomainOwnerType ownerType, Guid ownerId, IReadOnlyList<ResourceImageUploadFile> files, CancellationToken cancellationToken) =>
        Task.FromResult(ServiceResult<ResourceImageUploadResult>.Success(new ResourceImageUploadResult([], [])));

    public Task<Guid?> GetPrimaryImageIdAsync(DomainOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) =>
        Task.FromResult<Guid?>(null);

    public Task DeleteAllForOwnerAsync(DomainOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken)
    {
        DeleteAllForOwnerCalls.Add((ownerType, ownerId));
        return Task.CompletedTask;
    }

    public Task<ServiceResult<IReadOnlyList<ResourceImage>>> ListAsync(DomainOwnerType ownerType, Guid ownerId, CancellationToken cancellationToken) =>
        Task.FromResult(ServiceResult<IReadOnlyList<ResourceImage>>.Success([]));

    public Task<ResourceImage?> GetImageAsync(DomainOwnerType ownerType, Guid ownerId, Guid imageId, CancellationToken cancellationToken) =>
        Task.FromResult<ResourceImage?>(null);

    public Task<bool> DeleteAsync(DomainOwnerType ownerType, Guid ownerId, Guid imageId, CancellationToken cancellationToken) =>
        Task.FromResult(false);

    public Task<bool> SetPrimaryAsync(DomainOwnerType ownerType, Guid ownerId, Guid imageId, CancellationToken cancellationToken) =>
        Task.FromResult(false);
}
