$path = "C:\Users\PiPa\OneDrive\Documentos\Websave\OpenCode\SolaraCommerce\.git"
$acl = Get-Acl $path
$rules = $acl.Access | Where-Object { $_.IdentityReference.Value -like "*113633*" -and $_.AccessControlType -eq "Deny" }
foreach ($r in $rules) { $acl.RemoveAccessRule($r) | Out-Null }
Set-Acl $path $acl
Write-Output "removed deny PiPa"
Get-Acl $path | Format-List
