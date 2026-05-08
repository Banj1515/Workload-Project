using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeamWorkLoadAPI.Models
{
    [Table("UserTokens")]
    public class UserToken : IdentityUserToken<Guid>
    {
    }
}