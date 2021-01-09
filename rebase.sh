#!/bin/bash

git checkout master
git pull upstream
git push zaphodbe master

branches=( "dev" )
for x in "${branches[@]}"
do
  echo Rebasing branch $x
  git checkout $x
  git rebase master
  git push -f zaphodbe $x
done

