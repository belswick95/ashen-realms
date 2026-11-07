// Plain-language sign-in / sign-up messages. Supabase returns terse lower-case
// API errors ("email rate limit exceeded", "Invalid login credentials"); the
// login card shows a sentence a player can act on instead.
const RULES=[
 [/email rate limit|over_email_send_rate_limit/i,'Too many sign-up emails were sent just now. Please wait a few minutes and try again.'],
 [/rate limit|too many requests|429/i,'Too many attempts. Please wait a minute and try again.'],
 [/invalid login credentials|invalid_credentials/i,'That email and password do not match an account.'],
 [/email not confirmed|email_not_confirmed/i,'Please confirm your email address first: open the link we sent you, then sign in.'],
 [/user already registered|already been registered|user_already_exists/i,'An account with this email already exists. Sign in instead.'],
 [/password should be at least|weak_password/i,'Choose a longer password (at least 6 characters).'],
 [/unable to validate email|invalid format|email_address_invalid/i,'Please enter a valid email address.'],
 [/signups? not allowed|signup_disabled/i,'New accounts are closed right now. Please try again later.'],
 [/failed to fetch|networkerror|network request failed|load failed/i,'Could not reach the Eldervale servers. Check your connection and try again.'],
];
export function authErrorText(error){
 const raw=String(error?.message??error??'').trim(),code=String(error?.code??'');
 for(const [pattern,text] of RULES)if(pattern.test(raw)||(code&&pattern.test(code)))return text;
 if(!raw)return 'Something went wrong. Please try again.';
 // Unknown errors keep their detail but read as a sentence.
 const sentence=raw[0].toUpperCase()+raw.slice(1);
 return /[.!?]$/.test(sentence)?sentence:sentence+'.';
}
