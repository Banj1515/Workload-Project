using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class ReviewTaskChangeRequest
    {
        [Required]
        public bool Approved { get; set; }

        public string? Notes { get; set; }
    }
}