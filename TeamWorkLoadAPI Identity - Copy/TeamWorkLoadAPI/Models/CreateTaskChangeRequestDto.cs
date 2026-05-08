using System.ComponentModel.DataAnnotations;

namespace TeamWorkLoadAPI.Models
{
    public class CreateTaskChangeRequestDto : IValidatableObject
    {
        [Required]
        public Guid TaskId { get; set; }

        public string? RequestType { get; set; }
        public string? ChangeType { get; set; }

        public string? CurrentValue { get; set; }
        public string? PreviousValue { get; set; }

        public string? RequestedValue { get; set; }
        public string? NewValue { get; set; }

        [Required]
        public string? Reason { get; set; }

        public string? Notes { get; set; }

        public string EffectiveChangeType => NormalizeChangeType(
            !string.IsNullOrWhiteSpace(ChangeType) ? ChangeType : RequestType);

        public string EffectiveRequestedValue =>
            !string.IsNullOrWhiteSpace(RequestedValue)
                ? RequestedValue!.Trim()
                : NewValue?.Trim() ?? string.Empty;

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            var allowed = new[] { "OwnerChange", "DueDateChange", "EffortIncrease" };

            if (!allowed.Contains(EffectiveChangeType))
            {
                yield return new ValidationResult(
                    "ChangeType must be one of: OwnerChange, DueDateChange, EffortIncrease.",
                    new[] { nameof(ChangeType), nameof(RequestType) });
            }

            if (string.IsNullOrWhiteSpace(EffectiveRequestedValue))
            {
                yield return new ValidationResult(
                    "RequestedValue is required.",
                    new[] { nameof(RequestedValue), nameof(NewValue) });
            }

            if (string.IsNullOrWhiteSpace(Reason))
            {
                yield return new ValidationResult(
                    "Reason is required.",
                    new[] { nameof(Reason) });
            }

            if (EffectiveChangeType == "OwnerChange" &&
                !Guid.TryParse(EffectiveRequestedValue, out _))
            {
                yield return new ValidationResult(
                    "For OwnerChange, RequestedValue must be a valid user GUID.",
                    new[] { nameof(RequestedValue), nameof(NewValue) });
            }

            if (EffectiveChangeType == "DueDateChange" &&
                !DateOnly.TryParse(EffectiveRequestedValue, out _))
            {
                yield return new ValidationResult(
                    "For DueDateChange, RequestedValue must be a valid date in yyyy-MM-dd format.",
                    new[] { nameof(RequestedValue), nameof(NewValue) });
            }

            if (EffectiveChangeType == "EffortIncrease" &&
                !decimal.TryParse(EffectiveRequestedValue, out _))
            {
                yield return new ValidationResult(
                    "For EffortIncrease, RequestedValue must be a valid number.",
                    new[] { nameof(RequestedValue), nameof(NewValue) });
            }
        }

        private static string NormalizeChangeType(string? value)
        {
            return value?.Trim() switch
            {
                "Owner" => "OwnerChange",
                "Owner Change" => "OwnerChange",
                "OwnerChange" => "OwnerChange",

                "DueDate" => "DueDateChange",
                "Due Date" => "DueDateChange",
                "Due Date Change" => "DueDateChange",
                "DueDateChange" => "DueDateChange",

                "Effort" => "EffortIncrease",
                "Effort Hours" => "EffortIncrease",
                "Effort Increase" => "EffortIncrease",
                "EffortIncrease" => "EffortIncrease",

                _ => value?.Trim() ?? string.Empty
            };
        }
    }
}