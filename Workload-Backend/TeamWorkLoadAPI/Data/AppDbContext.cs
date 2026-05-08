using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TeamWorkLoadAPI.Models;

namespace TeamWorkLoadAPI.Data
{
    public class AppDbContext : IdentityDbContext<
        User,
        Role,
        Guid,
        UserClaim,
        UserRole,
        UserLogin,
        RoleClaim,
        UserToken>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<TaskItem> Tasks { get; set; }
        public DbSet<Team> Teams { get; set; }
        public DbSet<TeamMember> TeamMembers { get; set; }
        public DbSet<WeightMultiplier> WeightMultipliers { get; set; }
        public DbSet<TaskStatusHistory> TaskStatusHistories { get; set; }
        public DbSet<TaskChangeRequest> TaskChangeRequests { get; set; }
        public DbSet<TaskChangeHistory> TaskChangeHistories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>().ToTable("AspNetUsers");
            modelBuilder.Entity<Role>().ToTable("AspNetRoles");
            modelBuilder.Entity<UserRole>().ToTable("AspNetUserRoles");
            modelBuilder.Entity<UserClaim>().ToTable("AspNetUserClaims");
            modelBuilder.Entity<UserLogin>().ToTable("AspNetUserLogins");
            modelBuilder.Entity<UserToken>().ToTable("AspNetUserTokens");
            modelBuilder.Entity<RoleClaim>().ToTable("AspNetRoleClaims");

            modelBuilder.Entity<TaskItem>()
                .Property(t => t.EffortHours)
                .HasPrecision(10, 2);

            modelBuilder.Entity<WeightMultiplier>()
                .Property(w => w.Multiplier)
                .HasPrecision(10, 2);

            modelBuilder.Entity<TeamMember>()
                .HasKey(x => new { x.TeamId, x.UserId });

            modelBuilder.Entity<User>()
                .Property(u => u.DisplayName)
                .HasMaxLength(255);

            modelBuilder.Entity<User>()
                .Property(u => u.CreatedAt);

            modelBuilder.Entity<Team>()
                .ToTable("Team");

            modelBuilder.Entity<TaskItem>()
                .ToTable("Task");

            modelBuilder.Entity<WeightMultiplier>()
                .ToTable("WeightMultiplier");

            modelBuilder.Entity<TaskStatusHistory>()
                .ToTable("TaskStatusHistory");

            modelBuilder.Entity<TaskChangeRequest>()
                .ToTable("TaskChangeRequest");

            modelBuilder.Entity<TaskChangeHistory>()
                .ToTable("TaskChangeHistory");
        }
    }
}