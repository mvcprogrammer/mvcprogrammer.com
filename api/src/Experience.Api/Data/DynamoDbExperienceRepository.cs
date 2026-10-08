using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Experience.Api.Models;

namespace Experience.Api.Data;

/// <summary>Reads positions from the single-table DynamoDB store described in template.yaml.</summary>
public sealed class DynamoDbExperienceRepository(IAmazonDynamoDB dynamo, string tableName) : IExperienceRepository
{
    public async Task<IReadOnlyList<Position>> ListAsync(CancellationToken cancellationToken)
    {
        var request = new QueryRequest
        {
            TableName = tableName,
            KeyConditionExpression = "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":pk"] = new AttributeValue(PositionMapper.PartitionKey),
                [":prefix"] = new AttributeValue(PositionMapper.SortKeyPrefix),
            },
        };

        var positions = new List<Position>();
        do
        {
            var response = await dynamo.QueryAsync(request, cancellationToken);
            positions.AddRange(response.Items.Select(PositionMapper.FromItem));
            request.ExclusiveStartKey = response.LastEvaluatedKey;
        }
        while (request.ExclusiveStartKey is { Count: > 0 });

        return positions;
    }

    public async Task<Position?> GetAsync(string id, CancellationToken cancellationToken)
    {
        var response = await dynamo.GetItemAsync(
            new GetItemRequest { TableName = tableName, Key = PositionMapper.Key(id) },
            cancellationToken);

        return response.IsItemSet ? PositionMapper.FromItem(response.Item) : null;
    }

    // The function's IAM policy is read-only (DynamoDBReadPolicy in template.yaml). When the
    // admin API is built these become PutItem / conditional PutItem / DeleteItem and the
    // policy widens with them.

    public Task CreateAsync(Position position, CancellationToken cancellationToken) =>
        throw new NotImplementedException("Writes arrive with the admin API.");

    public Task<bool> UpdateAsync(Position position, CancellationToken cancellationToken) =>
        throw new NotImplementedException("Writes arrive with the admin API.");

    public Task<bool> DeleteAsync(string id, CancellationToken cancellationToken) =>
        throw new NotImplementedException("Writes arrive with the admin API.");
}
