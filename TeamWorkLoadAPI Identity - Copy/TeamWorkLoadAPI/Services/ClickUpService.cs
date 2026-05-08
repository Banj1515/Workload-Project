using System.Text.Json;
using TeamWorkLoadAPI.Models;

namespace TeamWorkLoadAPI.Services;

public sealed class ClickUpService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public ClickUpService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<JsonElement> GetTasksAsync(CancellationToken cancellationToken = default)
    {
        var options = _configuration.GetSection("ClickUp").Get<ClickUpOptions>();

        if (options is null || string.IsNullOrWhiteSpace(options.Token) || string.IsNullOrWhiteSpace(options.ListId))
        {
            throw new InvalidOperationException("ClickUp Token or ListId is missing in appsettings.json.");
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"https://api.clickup.com/api/v2/list/{options.ListId}/task"
        );

        request.Headers.TryAddWithoutValidation("Authorization", options.Token);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"ClickUp request failed: {(int)response.StatusCode} - {body}");
        }

        using var document = JsonDocument.Parse(body);
        return document.RootElement.Clone();
    }
}