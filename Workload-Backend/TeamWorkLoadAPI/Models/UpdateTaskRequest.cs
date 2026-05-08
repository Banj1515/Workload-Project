using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class UpdateTaskRequest
    {
        public Guid? TeamId { get; set; }

        [Required]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        public Guid? AssignedUserId { get; set; }

        [Required]
        public string Priority { get; set; } = string.Empty;

        [Required]
        public string Complexity { get; set; } = string.Empty;

        [Range(0, 9999)]
        public decimal EffortHours { get; set; }

        public DateOnly StartDate { get; set; }

        public DateOnly DueDate { get; set; }

        [Required]
        public string Status { get; set; } = "New";
    }
}