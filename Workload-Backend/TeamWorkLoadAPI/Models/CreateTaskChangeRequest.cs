using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class CreateTaskChangeRequest
    {
        [Required]
        public Guid TaskId { get; set; }

        [Required]
        public Guid RequestedByUserId { get; set; }

        [Required]
        [RegularExpression("^(Owner|DueDate|EffortHours)$", ErrorMessage = "ChangeType must be Owner, DueDate, or EffortHours.")]
        public string ChangeType { get; set; } = string.Empty;

        [Required]
        public string NewValue { get; set; } = string.Empty;
    }
}
