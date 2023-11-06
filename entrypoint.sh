#!/bin/bash

# Compile the C++ program
g++ -o main main.cpp -std=c++11 -O2 -Wall

# Check if compilation was successful
if [ $? -ne 0 ]; then
    echo "Compilation Error"
else
    timeout -s SIGKILL 2s ./main < input.txt > output.txt 2> error.txt
    EXIT_STATUS=$?

    # Check for Time Limit Exceeded (2 seconds) and Memory Limit Exceeded (256 MB)
    if [ $EXIT_STATUS -eq 124]; then
        echo "Time Limit Exceeded" >&2
    elif [ "$(stat -c %s error.txt)" -gt 262144 ]; then
        echo "Memory Limit Exceeded" >&2
    else
        # Check if the output is correct
        if diff -q output.txt expected_output.txt > /dev/null; then
            echo "Accepted"
        else
            echo "Wrong Answer"
        fi
    fi
fi