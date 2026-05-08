using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("TaskStatusHistory")]
    public class TaskStatusHistory
    {
        [Key]
        public Guid Id { get; set; }

        public Guid TaskId { get; set; }

        [MaxLength(100)]
        public string? OldStatus { get; set; }

        [MaxLength(100)]
        public string NewStatus { get; set; } = string.Empty;

        public Guid ChangedByUserId { get; set; }

        public DateTime ChangedAt { get; set; }
    }
}