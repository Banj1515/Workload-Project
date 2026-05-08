using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("TaskChangeHistory")]
    public class TaskChangeHistory
    {
        [Key]
        public Guid Id { get; set; }

        public Guid TaskId { get; set; }

        [Required]
        [MaxLength(100)]
        public string FieldName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? OldValue { get; set; }

        [MaxLength(255)]
        public string? NewValue { get; set; }

        public Guid ChangedByUserId { get; set; }

        public DateTime ChangedAt { get; set; }
    }
}