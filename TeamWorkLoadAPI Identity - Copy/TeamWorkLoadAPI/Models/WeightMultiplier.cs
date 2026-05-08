using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("WeightMultiplier")]
    public class WeightMultiplier
    {
        public Guid Id { get; set; }

        public string Category { get; set; } = string.Empty;

        public string Key { get; set; } = string.Empty;

        public decimal Multiplier { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}