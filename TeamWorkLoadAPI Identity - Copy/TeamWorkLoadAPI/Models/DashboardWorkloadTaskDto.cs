namespace TeamWorkLoadAPI.Models
{
    public class DashboardWorkloadTaskDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime DueDate { get; set; }
        public decimal EffortHours { get; set; }
        public decimal Weight { get; set; }
    }
}