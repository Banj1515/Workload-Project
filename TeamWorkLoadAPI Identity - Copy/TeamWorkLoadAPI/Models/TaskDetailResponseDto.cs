namespace TeamWorkLoadAPI.Models
{
    public class TaskDetailResponseDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string Complexity { get; set; } = string.Empty;
        public decimal EffortHours { get; set; }
        public object? WeightBreakdown { get; set; }
        public DateOnly StartDate { get; set; }
        public DateOnly DueDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public Guid? AssignedUserId { get; set; }
        public UserRefDto? AssignedMember { get; set; }
        public Guid TeamId { get; set; }
        public string? ClickUpTaskId { get; set; }
        public string? ClickUpListId { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public Guid? AcknowledgedByUserId { get; set; }
        public UserRefDto? AcknowledgedBy { get; set; }
        public DateTime? AcknowledgedAt { get; set; }
        public List<TaskStatusHistoryResponseDto> StatusHistory { get; set; } = new();
        public List<TaskFieldChangeHistoryResponseDto> FieldChangeHistory { get; set; } = new();
        public List<TaskChangeRequestHistoryResponseDto> ChangeHistory { get; set; } = new();
    }

    public class TaskStatusHistoryResponseDto
    {
        public Guid Id { get; set; }
        public string OldStatus { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public Guid ChangedByUserId { get; set; }
        public UserRefDto? ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public class TaskFieldChangeHistoryResponseDto
    {
        public Guid Id { get; set; }
        public string FieldName { get; set; } = string.Empty;
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public Guid ChangedByUserId { get; set; }
        public UserRefDto? ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public class TaskChangeRequestHistoryResponseDto
    {
        public Guid Id { get; set; }
        public string ChangeType { get; set; } = string.Empty;
        public string? CurrentValue { get; set; }
        public string? RequestedValue { get; set; }
        public string? Reason { get; set; }
        public string? Notes { get; set; }
        public string Status { get; set; } = string.Empty;
        public Guid RequestedByUserId { get; set; }
        public UserRefDto? RequestedBy { get; set; }
        public Guid? ReviewedByUserId { get; set; }
        public UserRefDto? ReviewedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
    }
}