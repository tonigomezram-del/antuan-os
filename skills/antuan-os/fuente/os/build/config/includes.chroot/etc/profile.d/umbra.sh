# Terminal Antuan en Antuan OS: indicador con los colores de Antuan y alias comodos en espanol
if [ -n "$BASH_VERSION" ] && [ -n "$PS1" ]; then
  _u_acc='\[\e[38;2;157;180;255m\]'; _u_dim='\[\e[38;2;139;145;163m\]'; _u_ok='\[\e[38;2;126;224;181m\]'; _u_r='\[\e[0m\]'
  PS1="${_u_acc}\u${_u_r}  ${_u_dim}\w${_u_r}  ${_u_acc}›${_u_r} "
  PROMPT_COMMAND='printf "\033]0;Terminal\007"'
  alias ls='ls --color=auto --group-directories-first'
  alias ll='ls -lh'
  alias actualizar='umbra --tienda'
  alias info='umbra-info'
fi
