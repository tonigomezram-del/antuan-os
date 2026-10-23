# Buscador de archivos de Antuan: consulta el indice de Windows Search (local, sin Bing).
# Entrada (stdin): "q <consulta en base64 UTF-8>". Salida: una linea JSON con los resultados.
$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$con = New-Object -ComObject ADODB.Connection
$con.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
$perfil = $env:USERPROFILE.Replace('\', '/')

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $out = @()
  try {
    if ($line.StartsWith("q ")) {
      $q = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line.Substring(2))).Replace("'", "''")
      $sql = "SELECT TOP 14 System.ItemUrl, System.ItemNameDisplay, System.ItemType, System.Size, System.DateModified FROM SystemIndex " +
             "WHERE SCOPE='file:$perfil' AND System.ItemNameDisplay LIKE '%$q%' AND NOT System.ItemPathDisplay LIKE '%\AppData\%' AND NOT System.ItemPathDisplay LIKE '%node_modules%' " +
             "AND NOT System.ItemPathDisplay LIKE '%\.git\%' AND NOT System.ItemNameDisplay LIKE '.%' AND NOT System.ItemPathDisplay LIKE '%\Code Cache\%' " +
             "ORDER BY System.Search.Rank DESC, System.DateModified DESC"
      $rs = New-Object -ComObject ADODB.Recordset
      $rs.Open($sql, $con)
      while (-not $rs.EOF) {
        $out += [pscustomobject]@{
          # ItemUrl = "file:C:/Users/..." (ruta real; ItemPathDisplay viene traducida)
          path = ([string]$rs.Fields.Item("System.ItemUrl").Value -replace '^file:', '').Replace('/', '\')
          name = [string]$rs.Fields.Item("System.ItemNameDisplay").Value
          type = [string]$rs.Fields.Item("System.ItemType").Value
          date = [string]$rs.Fields.Item("System.DateModified").Value
        }
        $rs.MoveNext()
      }
      $rs.Close()
    }
  } catch { }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject @($out) -Compress))
  [Console]::Out.Flush()
}
