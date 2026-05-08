using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("TaskChangeRequest")]
    public class TaskChangeRequest
    {
        public Guid Id { get; set; }

        public Guid TaskId { get; set; }

        public string ChangeType { get; set; } = string.Empty;

        public string? CurrentValue { get; set; }

        public string NewValue { get; set; } = string.Empty;

        public string? Reason { get; set; }

        public string? Notes { get; set; }

        public Guid RequestedByUserId { get; set; }

        public string Status { get; set; } = "Pending";

        public DateTime CreatedAt { get; set; }

        public Guid? ReviewedByUserId { get; set; }

        public DateTime? ReviewedAt { get; set; }
    }
}