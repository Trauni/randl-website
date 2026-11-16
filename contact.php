<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://randl.group');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo json_encode(['ok'=>false]); exit; }

// ── Config aus .env ───────────────────────────────────────────────
$_env = parse_ini_file(dirname(__DIR__) . '/private/.env');
if (!$_env) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'Serverkonfiguration fehlt']);
    exit;
}
define('TURNSTILE_SECRET', $_env['TURNSTILE_SECRET']);
define('SMTP_HOST', $_env['SMTP_HOST']  ?? 'mail.randlweb.de');
define('SMTP_PORT', (int)($_env['SMTP_PORT'] ?? 587));
define('SMTP_USER', $_env['SMTP_USER']);
define('SMTP_PASS', $_env['SMTP_PASS']);
define('SMTP_FROM', $_env['SMTP_FROM']  ?? $_env['SMTP_USER']);

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
$cfToken = trim($data['cf-turnstile-response'] ?? '');
if (!$cfToken) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'Sicherheitscheck fehlgeschlagen']);
    exit;
}
$cfVerify = @file_get_contents(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    false,
    stream_context_create(['http'=>[
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query(['secret'=>TURNSTILE_SECRET,'response'=>$cfToken,'remoteip'=>$_SERVER['REMOTE_ADDR']??'']),
        'timeout' => 5,
    ]])
);
$cfResult = $cfVerify ? json_decode($cfVerify, true) : null;
if (!($cfResult['success'] ?? false)) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'Sicherheitscheck fehlgeschlagen']);
    exit;
}
if (!empty($data['website']) || !empty($data['email_confirm'])) {
    echo json_encode(['ok'=>true]);
    exit;
}
$allowed = ['anfragen@randl.group', 'bestellung@randl.group'];
$to      = in_array($data['to'] ?? '', $allowed) ? $data['to'] : 'anfragen@randl.group';
$quelle  = trim($data['quelle'] ?? 'webformular');
$modus   = trim($data['modus']  ?? '');
$prefixMap = ['neukunde' => 'Neukundenanfrage', 'bestellung' => 'Bestellung', 'anfrage' => 'Anfrage'];
$prefix    = $prefixMap[$modus] ?? 'Anfrage';
$name  = trim($data['name'] ?? (($data['vorname']??'').' '.($data['nachname']??'')));
$email = trim($data['email'] ?? '');
$name  = trim($name) ?: 'Unbekannt';
function e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function tr($label, $val) {
    if (!$val && $val !== '0') return '';
    return "<tr><td style='padding:6px 0;color:#888;width:160px;vertical-align:top;font-size:13px'>".e($label)."</td>"
          ."<td style='padding:6px 0;font-size:13px;color:#333'>".e($val)."</td></tr>";
}
function sec($title, $rows) {
    if (!trim($rows)) return '';
    return "<div style='margin-top:16px;padding-top:14px;border-top:2px solid #f0f0f0'>"
          ."<p style='margin:0 0 8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#aaa;font-weight:700'>$title</p>"
          ."<table style='width:100%;border-collapse:collapse'>$rows</table></div>";
}
function fmtDate($s) {
    if (!$s) return '';
    $ts = strtotime($s);
    return $ts ? date('d.m.Y', $ts) : $s;
}
$d = $data;
// Kontakt
$c  = tr('Name',    $name);
$c .= tr('E-Mail',  $email);
$c .= tr('Telefon', $d['telefon'] ?? '');
$c .= tr('Firma',   $d['firma']   ?? '');
// Adresse
$a = '';
if (!empty($d['adresse'])) {
    $ad = $d['adresse'];
    $a .= tr('Straße',   $ad['strasse'] ?? '');
    $a .= tr('PLZ / Ort', trim(($ad['plz']??'').' '.($ad['ort']??'')));
    $a .= tr('Land',     $ad['land']    ?? '');
}
if (!empty($d['lieferanschrift_abweichend'])) {
    $l  = $d['lieferanschrift'] ?? [];
    $a .= tr('Lieferanschrift', trim(($l['strasse']??'').', '.($l['plz']??'').' '.($l['ort']??'')));
}
if (!empty($d['rechnungsanschrift_abweichend'])) {
    $r  = $d['rechnungsanschrift'] ?? [];
    $a .= tr('Rechnungsanschrift', trim(($r['strasse']??'').', '.($r['plz']??'').' '.($r['ort']??'')));
}
$a .= tr('Rechnungs-E-Mail', $d['rechnung_email'] ?? '');
// Projekt (generisch — deckt Zelt-Felder UND Metall-Felder ab)
$proj = '';
if (!empty($d['projekt']) && is_array($d['projekt'])) {
    $p = $d['projekt'];
    $proj .= tr('Projektname',          $p['name']                ?? '');
    $proj .= tr('Veranstaltungsort',    $p['veranstaltungsort']    ?? '');
    $proj .= tr('Veranstaltungsdatum',  fmtDate($p['veranstaltungsdatum'] ?? ''));
    $proj .= tr('Aufbau',               fmtDate($p['aufbau']       ?? ''));
    $proj .= tr('Abbau',                fmtDate($p['abbau']        ?? ''));
    $proj .= tr('Zeichnungen / 3D-Daten', $p['daten_vorhanden']     ?? '');
}
// Leistungen (Checkbox-Array — z.B. Zelt-Formular)
if (!empty($d['leistungen']) && is_array($d['leistungen'])) {
    $proj .= tr('Leistungen', implode(', ', $d['leistungen']));
}
// Details
$det  = tr('Kundentyp',     $d['kundentyp']  ?? '');
$det .= tr('Gastypen',      is_array($d['gastypen']    ?? null) ? implode(', ', $d['gastypen'])    : ($d['gastypen']    ?? ''));
$det .= tr('Gasprodukte',   is_array($d['gasprodukte'] ?? null) ? implode(', ', $d['gasprodukte']) : ($d['gasprodukte'] ?? ''));
$det .= tr('Lieferintervall', $d['lieferintervall'] ?? '');
$det .= tr('Kundennummer',  $d['kundennummer'] ?? '');
// Freitext — prüft Top-Level UND verschachtelt unter projekt.beschreibung (Metall)
$freitext = trim(
    $d['freitext']
    ?? $d['anmerkungen']
    ?? $d['beschreibung']
    ?? ($d['projekt']['beschreibung'] ?? '')
    ?? ''
);
$ftLabel  = $modus === 'bestellung' ? 'Bestellung' : 'Anmerkungen / Beschreibung';
$datum   = date('d.m.Y H:i');
$subject = "=?UTF-8?B?".base64_encode("{$prefix} von {$name} [{$quelle}]")."?=";
$body    = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif'>
<div style='max-width:580px;margin:28px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)'>
  <div style='background:#09090c;padding:22px 28px'>
    <p style='margin:0 0 4px;color:#f5a020;font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:700'>".e($prefix)." via randl.group</p>
    <p style='margin:0;color:rgba(255,255,255,.35);font-size:12px'>".e($quelle)."</p>
  </div>
  <div style='padding:24px 28px'>
    ".sec('Kontakt', $c)
    .sec('Adresse', $a)
    .sec('Projekt', $proj)
    .sec('Details', $det)
    .($freitext ? "<div style='margin-top:16px;padding-top:14px;border-top:2px solid #f0f0f0'>
      <p style='margin:0 0 8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#aaa;font-weight:700'>".e($ftLabel)."</p>
      <p style='margin:0;font-size:13px;line-height:1.7;color:#333;white-space:pre-wrap'>".e($freitext)."</p></div>" : '')."
  </div>
  <div style='padding:14px 28px;background:#fafafa;border-top:1px solid #eee'>
    <p style='margin:0;font-size:11px;color:#bbb'>Gesendet am {$datum} &middot; randl.group</p>
  </div>
</div></body></html>";
function smtp_send($host,$port,$user,$pass,$from,$replyto,$to,$subject,$html){
    $fp=fsockopen("tcp://{$host}",$port,$errno,$errstr,15);
    if(!$fp)return"Verbindung fehlgeschlagen: {$errstr}";
    function sr($fp){$r='';while(!feof($fp)){$l=fgets($fp,512);$r.=$l;if(substr($l,3,1)===' ')break;}return $r;}
    function sc($fp,$c){fputs($fp,$c."\r\n");return sr($fp);}
    sr($fp);sc($fp,"EHLO mail.randlweb.de");sc($fp,"STARTTLS");
    stream_socket_enable_crypto($fp,true,STREAM_CRYPTO_METHOD_TLS_CLIENT);
    sc($fp,"EHLO mail.randlweb.de");sc($fp,"AUTH LOGIN");sc($fp,base64_encode($user));
    $r=sc($fp,base64_encode($pass));
    if(strpos($r,'235')===false){fclose($fp);return"Auth fehlgeschlagen";}
    sc($fp,"MAIL FROM:<{$from}>");sc($fp,"RCPT TO:<{$to}>");sc($fp,"DATA");
    $msg="From: Randl Webformular <{$from}>\r\nReply-To: {$replyto}\r\nTo: {$to}\r\nSubject: {$subject}\r\n"
        ."MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\nX-Mailer: Randl-Form\r\n\r\n"
        .wordwrap(quoted_printable_encode($html),76,"\r\n",true)."\r\n.\r\n";
    $r=sc($fp,$msg);sc($fp,"QUIT");fclose($fp);
    return strpos($r,'250')!==false?null:"Senden fehlgeschlagen: {$r}";
}
$reply = $email ? "\"$name\" <$email>" : SMTP_FROM;
$err   = smtp_send(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, $reply, $to, $subject, $body);
error_log("contact.php smtp result: " . var_export($err, true));
if ($err===null) { echo json_encode(['ok'=>true]); }
else { error_log("contact.php: $err"); http_response_code(500); echo json_encode(['ok'=>false,'error'=>'Mail konnte nicht gesendet werden']); }
