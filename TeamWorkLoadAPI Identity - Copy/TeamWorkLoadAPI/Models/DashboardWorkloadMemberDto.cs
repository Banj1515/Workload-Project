namespace TeamWorkLoadAPI.Models
{
    public class DashboardWorkloadMemberDto
    {
        public Guid Id { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string TeamName { get; set; } = string.Empty;
        public string WorkloadStatus { get; set; } = "Available";
        public int TaskCount { get; set; }
        public decimal TotalEffort { get; set; }
        public decimal TotalWeight { get; set; }
        public List<DashboardWorkloadTaskDto> Tasks { get; set; } = new();
    }
}
