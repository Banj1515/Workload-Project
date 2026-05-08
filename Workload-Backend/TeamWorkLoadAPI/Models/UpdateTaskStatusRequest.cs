using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class UpdateTaskStatusRequest
    {
        [Required]
        [RegularExpression("^(New|In Progress|Blocked|Done)$", ErrorMessage = "Status must be New, In Progress, Blocked, or Done.")]
        public string Status { get; set; } = string.Empty;
    }
}