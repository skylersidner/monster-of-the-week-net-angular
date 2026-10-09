using SkiaSharp;

namespace MonsterOfTheWeek.Api.Tests.Services.ResourceImages;

/// <summary>
/// Real, minimal, valid image byte arrays for Phase 2's validation tests, generated with
/// SkiaSharp at test time rather than checked in as base64 blobs — this project has never needed
/// binary test fixtures before (phases.md §3.5), and generating them keeps the fixtures small,
/// inspectable in code, and exercised through the same library the service itself uses to decode
/// them.
/// </summary>
internal static class ResourceImageTestFixtures
{
    public static byte[] TinyJpeg() => Encode(10, 10, SKEncodedImageFormat.Jpeg);

    public static byte[] TinyPng() => Encode(10, 10, SKEncodedImageFormat.Png);

    public static byte[] TinyWebp() => Encode(10, 10, SKEncodedImageFormat.Webp);

    /// <summary>One axis over the 4096-pixel cap — kept thin on the other axis so the fixture
    /// itself stays cheap to allocate and encode.</summary>
    public static byte[] OversizedDimensionJpeg() => Encode(4097, 8, SKEncodedImageFormat.Jpeg);

    /// <summary>
    /// A real JPEG's first 10 bytes: the magic-byte sniff still recognizes it (so this exercises
    /// the dimension-read failure specifically, not the type check), but there isn't enough of
    /// the file left for a header decode to succeed.
    /// </summary>
    public static byte[] TruncatedJpeg() => TinyJpeg()[..10];

    /// <summary>Doesn't match any of the three accepted signatures — exercises UnsupportedType
    /// without ever reaching a decode.</summary>
    public static byte[] GifBytes() => "GIF89a"u8.ToArray().Concat(new byte[10]).ToArray();

    /// <summary>
    /// A RIFF container that isn't WebP (a WAVE marker instead) — proves the WebP check is
    /// genuinely "RIFF + WEBP at offset 8," not just "starts with RIFF" (design.md §7.1).
    /// </summary>
    public static byte[] RiffWaveBytes() =>
        [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0, 0, 0, 0];

    /// <summary>Plain filler, not a parseable image at all — the size check runs before the type
    /// check, so this only needs to be large, not valid.</summary>
    public static byte[] OverTwoMebibytes() => new byte[(2 * 1024 * 1024) + 1];

    private static byte[] Encode(int width, int height, SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(SKColors.CornflowerBlue);
        }

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 90);
        return data.ToArray();
    }
}
