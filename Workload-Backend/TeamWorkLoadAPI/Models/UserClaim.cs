using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("UserClaims")]
    public class UserClaim : IdentityUserClaim<Guid>
    {
    }
}