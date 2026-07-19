namespace MonsterOfTheWeek.Api.Services;

public enum ServiceErrorType
{
    NotFound,
    Validation
}

public sealed record ServiceError(ServiceErrorType Type, string Message);

public sealed class ServiceResult<T>
{
    public T? Value { get; init; }
    public ServiceError? Error { get; init; }

    public bool IsSuccess => Error is null;

    public static ServiceResult<T> Success(T value) => new() { Value = value };

    public static ServiceResult<T> NotFound(string message) => new()
    {
        Error = new ServiceError(ServiceErrorType.NotFound, message)
    };

    public static ServiceResult<T> Validation(string message) => new()
    {
        Error = new ServiceError(ServiceErrorType.Validation, message)
    };
}
