using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MonsterOfTheWeek.Api.Contracts;
using MonsterOfTheWeek.Api.Services;

namespace MonsterOfTheWeek.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<CurrentUserResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await authService.VerifyCredentialsAsync(request.Email, request.Password, cancellationToken);
        if (!result.IsSuccess)
        {
            // 400, never 401. 401 is reserved API-wide for "no valid session"; returning it here
            // would trip the Angular authErrorInterceptor's session-gone branch, which swallows the
            // error and navigates to /login — leaving the login form showing nothing at all.
            // phases.md decision #9 / architecture.md section 1.4.
            return BadRequest(new { code = "invalid_credentials" });
        }

        var user = result.Value!;

        // NameIdentifier and Name are not arbitrary: they are the claim types Identity uses by
        // default, so anything reading the current user id or email keeps working unchanged when
        // the robust plan lands. architecture.md section 1.3.
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Email)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties { IsPersistent = true });

        return Ok(user);
    }

    // Authenticated by design (no [AllowAnonymous]) — signing out with no session is a no-op and
    // letting it 401 is the right outcome.
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    // Must never 401: the Angular bootstrap probe calls this on every cold load, including for a
    // logged-out visitor, and a 401 here would fire an error toast on the login page.
    [HttpGet("me")]
    [AllowAnonymous]
    public ActionResult<CurrentUserResponse?> Me()
    {
        CurrentUserResponse? user = null;

        if (User.Identity?.IsAuthenticated == true)
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var email = User.FindFirstValue(ClaimTypes.Name);

            if (Guid.TryParse(id, out var userId) && !string.IsNullOrEmpty(email))
            {
                user = new CurrentUserResponse(userId, email);
            }
        }

        // JsonResult, not Ok(), on purpose. Ok(null) produces an ObjectResult with a null value,
        // which HttpNoContentOutputFormatter turns into a 204 — and section 3.2 pins this response as
        // 200 with a literal JSON null. JsonResult bypasses that formatter, so the fix stays local
        // to this action instead of removing the formatter globally and changing every other
        // endpoint that returns null.
        return new JsonResult(user);
    }
}
