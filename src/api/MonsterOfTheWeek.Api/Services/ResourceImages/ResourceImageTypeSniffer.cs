namespace MonsterOfTheWeek.Api.Services.ResourceImages;

/// <summary>
/// Determines a file's real type from its content, never from a client-declared
/// <c>Content-Type</c> header or its extension — both are trivially spoofable (design.md §7.1).
///
/// <para>
/// WebP gets its own check rather than a third literal bolted onto JPEG/PNG's lookup, called out
/// explicitly in <c>design.md</c> §7.1 as a gap worth guarding against on purpose: JPEG and PNG
/// each start with one short, fixed byte sequence, but WebP is a RIFF container — a 4-byte
/// <c>RIFF</c> marker, a 4-byte file size, then a 4-byte <c>WEBP</c> marker at offset 8 — a
/// genuinely different structure to check, not just another entry in the same table.
/// </para>
/// </summary>
internal static class ResourceImageTypeSniffer
{
    private static readonly byte[] JpegSignature = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] RiffMarker = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
    private static readonly byte[] WebpMarker = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

    /// <summary>
    /// Returns the sniffed <c>Content-Type</c> (<c>image/jpeg</c>, <c>image/png</c>, or
    /// <c>image/webp</c>), or <c>null</c> if <paramref name="content"/> doesn't match any of the
    /// three accepted signatures.
    /// </summary>
    public static string? DetectContentType(byte[] content)
    {
        if (StartsWith(content, JpegSignature))
        {
            return "image/jpeg";
        }

        if (StartsWith(content, PngSignature))
        {
            return "image/png";
        }

        if (IsWebp(content))
        {
            return "image/webp";
        }

        return null;
    }

    private static bool IsWebp(byte[] content) =>
        content.Length >= 12 &&
        StartsWith(content, RiffMarker) &&
        content[8] == WebpMarker[0] && content[9] == WebpMarker[1] &&
        content[10] == WebpMarker[2] && content[11] == WebpMarker[3];

    private static bool StartsWith(byte[] content, byte[] signature)
    {
        if (content.Length < signature.Length)
        {
            return false;
        }

        for (var i = 0; i < signature.Length; i++)
        {
            if (content[i] != signature[i])
            {
                return false;
            }
        }

        return true;
    }
}
