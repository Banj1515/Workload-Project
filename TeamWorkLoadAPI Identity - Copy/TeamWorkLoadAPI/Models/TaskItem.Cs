using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("Task")]
    public class TaskItem
    {
        public Guid Id { get; set; }
        public Guid? TeamId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid? AssignedUserId { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string Complexity { get; set; } = string.Empty;
        public decimal EffortHours { get; set; }
        public DateOnly StartDate { get; set; }
        public DateOnly DueDate { get; set; }
        public string Status { get; set; } = "New";
        public Guid CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? ClickUpTaskId { get; set; }
        public string? ClickUpListId { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        public Guid? AcknowledgedByUserId { get; set; }
        public DateTime? AcknowledgedAt { get; set; }
    }
}