using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("UserLogins")]
    public class UserLogin : IdentityUserLogin<Guid>
    {
    }
}