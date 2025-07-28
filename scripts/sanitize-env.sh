#!/bin/bash
# Sanitize .env and .env.secrets to remove newlines from values
for file in .env .env.secrets; do
  if [[ -f "$file" ]]; then
    echo "Sanitizing $file..."
    awk -F= '{
      key=$1
      $1=""
      value=substr($0,2)
      gsub(/\n/,"\\n",value)
      gsub(/^ +| +$/,"",key)
      gsub(/^ +| +$/,"",value)
      if (key!="" && key!~/#/) print key "=" value
    }' "$file" > "$file.sanitized"
    mv "$file.sanitized" "$file"
    echo "Sanitized $file."
  fi

done
