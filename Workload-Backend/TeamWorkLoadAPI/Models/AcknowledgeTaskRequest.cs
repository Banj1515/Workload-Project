using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class AcknowledgeTaskRequest
    {
        [Required]
        public Guid UserId { get; set; }
    }
}