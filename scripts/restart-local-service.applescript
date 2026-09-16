on run
  display notification "正在启动网页与音频分析服务" with title "MelodyVision"
  try
    with timeout of 120 seconds
      set serviceOutput to do shell script "/bin/zsh -lc " & quoted form of "cd /Users/wangyu/MelodyVision && /opt/homebrew/bin/node scripts/restart-local-service.mjs"
    end timeout
    set studyURL to paragraph 1 of serviceOutput
    set researchURL to paragraph 2 of serviceOutput
    display notification "本地服务已经就绪" with title "MelodyVision" subtitle studyURL
    open location studyURL
    open location researchURL
  on error errorMessage
    display dialog "本地服务重启失败：" & return & return & errorMessage & return & return & "日志：/Users/wangyu/MelodyVision/data/runtime/dev-full.log" buttons {"好"} default button "好" with icon stop with title "MelodyVision"
  end try
end run
