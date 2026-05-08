using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class UpdateWeightMultiplierRequest
    {
        [Required]
        [RegularExpression("^(Priority|Complexity)$", ErrorMessage = "Category must be Priority or Complexity.")]
        public string Category { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;

        [Range(0.1, 999)]
        public decimal Multiplier { get; set; }
    }
}